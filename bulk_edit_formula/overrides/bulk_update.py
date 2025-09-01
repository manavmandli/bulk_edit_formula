import frappe
from frappe import _
from frappe.utils.scheduler import is_scheduler_inactive
from frappe.core.doctype.submission_queue.submission_queue import queue_submission
from frappe.utils import flt,cint
from frappe.desk.doctype.bulk_update.bulk_update import BulkUpdate

class CustomBulkUpdate(BulkUpdate):
    @frappe.whitelist()
    def bulk_update(self):
        self.check_permission("write")
        limit = self.limit if self.limit and cint(self.limit) < 500 else 500

        condition = ""
        if self.condition:
            if ";" in self.condition:
                frappe.throw(_("; not allowed in condition"))

            condition = f" where {self.condition}"

        docnames = frappe.db.sql_list(
            f"""select name from `tab{self.document_type}`{condition} limit {limit} offset 0"""
        )
        return custom_submit_cancel_or_update_docs(
            self.document_type, docnames, "update", {self.field: self.update_value}
        )

@frappe.whitelist()
def custom_submit_cancel_or_update_docs(
    doctype, docnames, action="submit", data=None, task_id=None
):
    if isinstance(docnames, str):
        docnames = frappe.parse_json(docnames)

    if len(docnames) < 20:
        return custom_bulk_action(doctype, docnames, action, data, task_id)
    elif len(docnames) <= 500:
        frappe.msgprint(_("Bulk operation is enqueued in background."), alert=True)
        frappe.enqueue(
            custom_bulk_action,
            doctype=doctype,
            docnames=docnames,
            action=action,
            data=data,
            task_id=task_id,
            queue="short",
            timeout=1000,
        )
    else:
        frappe.throw(
            _("Bulk operations only support up to 500 documents."),
            title=_("Too Many Documents"),
        )


def custom_bulk_action(doctype, docnames, action, data, task_id=None):
    if data:
        data = frappe.parse_json(data)

    failed = []
    num_documents = len(docnames)

    for idx, docname in enumerate(docnames, 1):
        doc = frappe.get_doc(doctype, docname)
        try:
            message = ""
            if action == "submit" and doc.docstatus.is_draft():
                if doc.meta.queue_in_background and not is_scheduler_inactive():
                    queue_submission(doc, action)
                    message = _("Queuing {0} for Submission").format(doctype)
                else:
                    doc.submit()
                    message = _("Submitting {0}").format(doctype)
            elif action == "cancel" and doc.docstatus.is_submitted():
                doc.cancel()
                message = _("Cancelling {0}").format(doctype)
            elif action == "update" and not doc.docstatus.is_cancelled():
                for field, val in data.items():
                    val = apply_formula(doc, field, val)
                    doc.set(field, val)
                doc.save()
                message = _("Updating {0}").format(doctype)
            else:
                failed.append(docname)
            frappe.db.commit()
            frappe.publish_progress(
                percent=idx / num_documents * 100,
                title=message,
                description=docname,
                task_id=task_id,
            )

        except Exception:
            failed.append(docname)
            frappe.db.rollback()

    return failed


def apply_formula(doc, field, update_value):
    if (
        not update_value
        or not isinstance(update_value, str)
        or not update_value.startswith("=")
    ):
        return update_value

    formula = update_value[1:]  # remove '='
    current_val = flt(doc.get(field) or 0)

    try:
        if formula.startswith("+"):
            return current_val + flt(formula[1:])
        elif formula.startswith("-"):
            return current_val - flt(formula[1:])
        elif formula.startswith("*"):
            return current_val * flt(formula[1:])
        elif formula.startswith("/"):
            operand = flt(formula[1:])
            return current_val / operand if operand != 0 else current_val
        elif formula.startswith("%"):
            operand = flt(formula[1:])
            return current_val % operand if operand != 0 else current_val

        context = {"current": current_val}
        return frappe.safe_eval(formula, context)
    except Exception:
        return update_value
