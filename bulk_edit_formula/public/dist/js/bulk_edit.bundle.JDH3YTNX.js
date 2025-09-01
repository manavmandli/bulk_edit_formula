(() => {
  // ../bulk_edit_formula/bulk_edit_formula/public/js/bulk_operations.js
  var CustomBulkOperations = class {
    constructor({ doctype }) {
      if (!doctype)
        frappe.throw(__("Doctype required"));
      this.doctype = doctype;
    }
    print(docs) {
      const print_settings = frappe.model.get_doc(":Print Settings", "Print Settings");
      const allow_print_for_draft = cint(print_settings.allow_print_for_draft);
      const is_submittable = frappe.model.is_submittable(this.doctype);
      const allow_print_for_cancelled = cint(print_settings.allow_print_for_cancelled);
      const letterheads = this.get_letterhead_options();
      const MAX_PRINT_LIMIT = 500;
      const BACKGROUND_PRINT_THRESHOLD = 25;
      const valid_docs = docs.filter((doc) => {
        return !is_submittable || doc.docstatus === 1 || allow_print_for_cancelled && doc.docstatus == 2 || allow_print_for_draft && doc.docstatus == 0 || frappe.user.has_role("Administrator");
      }).map((doc) => doc.name);
      const invalid_docs = docs.filter((doc) => !valid_docs.includes(doc.name));
      if (invalid_docs.length > 0) {
        frappe.msgprint(__("You selected Draft or Cancelled documents"));
        return;
      }
      if (valid_docs.length === 0) {
        frappe.msgprint(__("Select atleast 1 record for printing"));
        return;
      }
      if (valid_docs.length > MAX_PRINT_LIMIT) {
        frappe.msgprint(
          __("You can only print upto {0} documents at a time", [MAX_PRINT_LIMIT])
        );
        return;
      }
      const dialog = new frappe.ui.Dialog({
        title: __("Print Documents"),
        fields: [
          {
            fieldtype: "Select",
            label: __("Letter Head"),
            fieldname: "letter_sel",
            options: letterheads,
            default: letterheads[0]
          },
          {
            fieldtype: "Select",
            label: __("Print Format"),
            fieldname: "print_sel",
            options: frappe.meta.get_print_formats(this.doctype),
            default: frappe.get_meta(this.doctype).default_print_format
          },
          {
            fieldtype: "Select",
            label: __("Page Size"),
            fieldname: "page_size",
            options: frappe.meta.get_print_sizes(),
            default: print_settings.pdf_page_size
          },
          {
            fieldtype: "Float",
            label: __("Page Height (in mm)"),
            fieldname: "page_height",
            depends_on: 'eval:doc.page_size == "Custom"',
            default: print_settings.pdf_page_height
          },
          {
            fieldtype: "Float",
            label: __("Page Width (in mm)"),
            fieldname: "page_width",
            depends_on: 'eval:doc.page_size == "Custom"',
            default: print_settings.pdf_page_width
          },
          {
            fieldtype: "Check",
            label: __("Background Print (required for >25 documents)"),
            fieldname: "background_print",
            default: valid_docs.length > BACKGROUND_PRINT_THRESHOLD,
            read_only: valid_docs.length > BACKGROUND_PRINT_THRESHOLD
          }
        ]
      });
      dialog.set_primary_action(__("Print"), (args) => {
        if (!args)
          return;
        const default_print_format = frappe.get_meta(this.doctype).default_print_format;
        const with_letterhead = args.letter_sel == __("No Letterhead") ? 0 : 1;
        const print_format = args.print_sel ? args.print_sel : default_print_format;
        const json_string = JSON.stringify(valid_docs);
        const letterhead = args.letter_sel;
        let pdf_options;
        if (args.page_size === "Custom") {
          if (args.page_height === 0 || args.page_width === 0) {
            frappe.throw(__("Page height and width cannot be zero"));
          }
          pdf_options = JSON.stringify({
            "page-height": args.page_height,
            "page-width": args.page_width
          });
        } else {
          pdf_options = JSON.stringify({ "page-size": args.page_size });
        }
        if (args.background_print) {
          frappe.call("frappe.utils.print_format.download_multi_pdf_async", {
            doctype: this.doctype,
            name: json_string,
            format: print_format,
            no_letterhead: with_letterhead ? "0" : "1",
            letterhead,
            options: pdf_options
          }).then((response) => {
            let task_id = response.message.task_id;
            frappe.realtime.task_subscribe(task_id);
            frappe.realtime.on(`task_complete:${task_id}`, (data) => {
              frappe.msgprint({
                title: __("Bulk PDF Export"),
                message: __("Your PDF is ready for download"),
                primary_action: {
                  label: __("Download PDF"),
                  client_action: "window.open",
                  args: data.file_url
                }
              });
              frappe.realtime.task_unsubscribe(task_id);
              frappe.realtime.off(`task_complete:${task_id}`);
            });
          });
        } else {
          const w = window.open(
            "/api/method/frappe.utils.print_format.download_multi_pdf?doctype=" + encodeURIComponent(this.doctype) + "&name=" + encodeURIComponent(json_string) + "&format=" + encodeURIComponent(print_format) + "&no_letterhead=" + (with_letterhead ? "0" : "1") + "&letterhead=" + encodeURIComponent(letterhead) + "&options=" + encodeURIComponent(pdf_options)
          );
          if (!w) {
            frappe.msgprint(__("Please enable pop-ups"));
          }
        }
        dialog.hide();
      });
      dialog.show();
    }
    get_letterhead_options() {
      const letterhead_options = [__("No Letterhead")];
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "Letter Head",
          fields: ["name", "is_default"],
          filters: { disabled: 0 },
          limit_page_length: 0
        },
        async: false,
        callback(r) {
          if (r.message) {
            r.message.forEach((letterhead) => {
              if (letterhead.is_default) {
                letterhead_options.unshift(letterhead.name);
              } else {
                letterhead_options.push(letterhead.name);
              }
            });
          }
        }
      });
      return letterhead_options;
    }
    delete(docnames, done = null) {
      frappe.call({
        method: "frappe.desk.reportview.delete_items",
        freeze: true,
        freeze_message: docnames.length <= 10 ? __("Deleting {0} records...", [docnames.length]) : null,
        args: {
          items: docnames,
          doctype: this.doctype
        }
      }).then((r) => {
        let failed = r.message;
        if (!failed)
          failed = [];
        if (failed.length && !r._server_messages) {
          frappe.throw(
            __("Cannot delete {0}", [failed.map((f) => f.bold()).join(", ")])
          );
        }
        if (failed.length < docnames.length) {
          frappe.utils.play_sound("delete");
          if (done)
            done();
        }
      });
    }
    assign(docnames, done) {
      if (docnames.length > 0) {
        const assign_to = new frappe.ui.form.AssignToDialog({
          obj: this,
          method: "frappe.desk.form.assign_to.add_multiple",
          doctype: this.doctype,
          docname: docnames,
          bulk_assign: true,
          re_assign: true,
          callback: done
        });
        assign_to.dialog.clear();
        assign_to.dialog.show();
      } else {
        frappe.msgprint(__("Select records for assignment"));
      }
    }
    clear_assignment(docnames, done) {
      if (docnames.length > 0) {
        frappe.call({
          method: "frappe.desk.form.assign_to.remove_multiple",
          args: {
            doctype: this.doctype,
            names: docnames,
            ignore_permissions: true
          },
          freeze: true,
          freeze_message: "Removing assignments..."
        }).then(() => {
          done();
        });
      } else {
        frappe.msgprint(__("Select records for removing assignment"));
      }
    }
    apply_assignment_rule(docnames, done) {
      if (docnames.length > 0) {
        frappe.call("frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply", {
          doctype: this.doctype,
          docnames
        }).then(() => done());
      }
    }
    submit_or_cancel(docnames, action = "submit", done = null) {
      action = action.toLowerCase();
      const task_id = Math.random().toString(36).slice(-5);
      frappe.realtime.task_subscribe(task_id);
      return frappe.xcall("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", {
        doctype: this.doctype,
        action,
        docnames,
        task_id
      }).then((failed_docnames) => {
        if (failed_docnames == null ? void 0 : failed_docnames.length) {
          const comma_separated_records = frappe.utils.comma_and(failed_docnames);
          switch (action) {
            case "submit":
              frappe.throw(__("Cannot submit {0}.", [comma_separated_records]));
              break;
            case "cancel":
              frappe.throw(__("Cannot cancel {0}.", [comma_separated_records]));
              break;
            default:
              frappe.throw(__("Cannot {0} {1}.", [action, comma_separated_records]));
          }
        }
        if ((failed_docnames == null ? void 0 : failed_docnames.length) < docnames.length) {
          frappe.utils.play_sound(action);
          if (done)
            done();
        }
      }).finally(() => {
        frappe.realtime.task_unsubscribe(task_id);
      });
    }
    edit(docnames, field_mappings, done) {
      console.log("Bulk Edit", docnames, field_mappings);
      let field_options = Object.keys(field_mappings).sort(function(a, b) {
        return __(cstr(field_mappings[a].label)).localeCompare(
          cstr(__(field_mappings[b].label))
        );
      });
      const status_regex = /status/i;
      const numeric_fieldtypes = ["Int", "Float", "Currency", "Percent"];
      const default_field = field_options.find((value) => status_regex.test(value));
      const dialog = new frappe.ui.Dialog({
        title: __("Bulk Edit"),
        fields: [
          {
            fieldtype: "Select",
            options: field_options,
            default: default_field,
            label: __("Field"),
            fieldname: "field",
            reqd: 1,
            onchange: () => {
              set_value_field(dialog);
            }
          },
          {
            fieldtype: "Data",
            label: __("Value"),
            fieldname: "value",
            onchange() {
              show_help_text();
            }
          }
        ],
        primary_action: ({ value }) => {
          const fieldname = field_mappings[dialog.get_value("field")].fieldname;
          dialog.disable_primary_action();
          frappe.call({
            method: "bulk_edit_formula.overrides.bulk_update.custom_submit_cancel_or_update_docs",
            args: {
              doctype: cur_list.doctype,
              freeze: true,
              docnames,
              action: "update",
              data: {
                [fieldname]: value || null
              }
            }
          }).then((r) => {
            let failed = r.message || [];
            if (failed.length && !r._server_messages) {
              dialog.enable_primary_action();
              frappe.throw(
                __("Cannot update {0}", [
                  failed.map((f) => f.bold ? f.bold() : f).join(", ")
                ])
              );
            }
            done();
            dialog.hide();
            frappe.show_alert(__("Updated successfully"));
          });
        },
        primary_action_label: __("Update {0} records", [docnames.length])
      });
      if (default_field)
        set_value_field(dialog);
      show_help_text();
      function set_value_field(dialogObj) {
        const new_df = Object.assign({}, field_mappings[dialogObj.get_value("field")]);
        if (new_df.label.match(status_regex) && new_df.fieldtype === "Select" && !new_df.default) {
          let options = [];
          if (typeof new_df.options === "string") {
            options = new_df.options.split("\n");
          }
          new_df.default = options[0] || options[1];
        }
        new_df.label = __("Value");
        new_df.onchange = show_help_text;
        if (numeric_fieldtypes.includes(new_df.fieldtype)) {
          new_df.fieldtype = "Data";
        }
        delete new_df.depends_on;
        dialogObj.replace_field("value", new_df);
        show_help_text();
      }
      function show_help_text() {
        var _a;
        let value = dialog.get_value("value");
        let fieldname = dialog.get_value("field");
        let fieldtype = (_a = field_mappings[fieldname]) == null ? void 0 : _a.fieldtype;
        if (value == null || value === "") {
          if (numeric_fieldtypes.includes(fieldtype)) {
            dialog.set_df_property(
              "value",
              "description",
              __("Enter a number or formula (e.g. =*2, +10, /3)")
            );
          } else {
            dialog.set_df_property(
              "value",
              "description",
              __("You have not entered a value. The field will be set to empty.")
            );
          }
        } else {
          dialog.set_df_property("value", "description", "");
        }
      }
      dialog.refresh();
      dialog.show();
    }
    add_tags(docnames, done) {
      const dialog = new frappe.ui.Dialog({
        title: __("Add Tags"),
        fields: [
          {
            fieldtype: "MultiSelectPills",
            fieldname: "tags",
            label: __("Tags"),
            reqd: true,
            get_data: function(txt) {
              return frappe.db.get_link_options("Tag", txt);
            }
          }
        ],
        primary_action_label: __("Add"),
        primary_action: () => {
          let args = dialog.get_values();
          if (args && args.tags) {
            dialog.set_message("Adding Tags...");
            frappe.call({
              method: "frappe.desk.doctype.tag.tag.add_tags",
              args: {
                tags: args.tags,
                dt: this.doctype,
                docs: docnames
              },
              callback: () => {
                dialog.hide();
                done();
              }
            });
          }
        }
      });
      dialog.show();
    }
    export(doctype, docnames) {
      frappe.require("data_import_tools.bundle.js", () => {
        const data_exporter = new frappe.data_import.DataExporter(
          doctype,
          "Insert New Records"
        );
        data_exporter.dialog.set_value("export_records", "by_filter");
        data_exporter.filter_group.add_filters_to_filter_group([
          [doctype, "name", "in", docnames, false]
        ]);
      });
    }
  };

  // ../bulk_edit_formula/bulk_edit_formula/public/js/list_view.js
  frappe.views.ListView = class ListView extends frappe.views.ListView {
    get_actions_menu_items() {
      const doctype = this.doctype;
      const actions_menu_items = [];
      const bulk_operations = new CustomBulkOperations({ doctype: this.doctype });
      const is_field_editable = (field_doc) => {
        return field_doc.fieldname && frappe.model.is_value_type(field_doc) && field_doc.fieldtype !== "Read Only" && !field_doc.hidden && !field_doc.read_only && !field_doc.is_virtual;
      };
      const has_editable_fields = (doctype2) => {
        return frappe.meta.get_docfields(doctype2).some((field_doc) => is_field_editable(field_doc));
      };
      const has_submit_permission = (doctype2) => {
        return frappe.perm.has_perm(doctype2, 0, "submit");
      };
      const is_bulk_edit_allowed = (doctype2) => {
        var _a;
        if (frappe.model.has_workflow(doctype2)) {
          return !!((_a = this.list_view_settings) == null ? void 0 : _a.allow_edit);
        }
        return true;
      };
      const bulk_assignment = () => {
        return {
          label: __("Assign To", null, "Button in list view actions menu"),
          action: () => {
            this.disable_list_update = true;
            bulk_operations.assign(this.get_checked_items(true), () => {
              this.disable_list_update = false;
              this.clear_checked_items();
              this.refresh();
            });
          },
          standard: true
        };
      };
      const bulk_assignment_clear = () => {
        return {
          label: __("Clear Assignment", null, "Button in list view actions menu"),
          action: () => {
            frappe.confirm(
              __("Are you sure you want to clear the assignments?"),
              () => {
                this.disable_list_update = true;
                bulk_operations.clear_assignment(this.get_checked_items(true), () => {
                  this.disable_list_update = false;
                  this.clear_checked_items();
                  this.refresh();
                });
              },
              () => {
                this.clear_checked_items();
                this.refresh();
              }
            );
          },
          standard: true
        };
      };
      const bulk_assignment_rule = () => {
        return {
          label: __("Apply Assignment Rule", null, "Button in list view actions menu"),
          action: () => {
            this.disable_list_update = true;
            bulk_operations.apply_assignment_rule(this.get_checked_items(true), () => {
              this.disable_list_update = false;
              this.clear_checked_items();
              this.refresh();
            });
          },
          standard: true
        };
      };
      const bulk_add_tags = () => {
        return {
          label: __("Add Tags", null, "Button in list view actions menu"),
          action: () => {
            this.disable_list_update = true;
            bulk_operations.add_tags(this.get_checked_items(true), () => {
              this.disable_list_update = false;
              this.clear_checked_items();
              this.refresh();
            });
          },
          standard: true
        };
      };
      const bulk_printing = () => {
        return {
          label: __("Print", null, "Button in list view actions menu"),
          action: () => bulk_operations.print(this.get_checked_items()),
          standard: true
        };
      };
      const bulk_delete = () => {
        return {
          label: __("Delete", null, "Button in list view actions menu"),
          action: () => {
            const docnames = this.get_checked_items(true).map(
              (docname) => docname.toString()
            );
            let message = __(
              "Delete {0} item permanently?",
              [docnames.length],
              "Title of confirmation dialog"
            );
            if (docnames.length > 1) {
              message = __(
                "Delete {0} items permanently?",
                [docnames.length],
                "Title of confirmation dialog"
              );
            }
            frappe.confirm(message, () => {
              this.disable_list_update = true;
              bulk_operations.delete(docnames, () => {
                this.disable_list_update = false;
                this.clear_checked_items();
                this.refresh();
              });
            });
          },
          standard: true
        };
      };
      const bulk_cancel = () => {
        return {
          label: __("Cancel", null, "Button in list view actions menu"),
          action: () => {
            const docnames = this.get_checked_items(true);
            if (docnames.length > 0) {
              frappe.confirm(
                __(
                  "Cancel {0} documents?",
                  [docnames.length],
                  "Title of confirmation dialog"
                ),
                () => {
                  this.disable_list_update = true;
                  bulk_operations.submit_or_cancel(docnames, "cancel", () => {
                    this.disable_list_update = false;
                    this.clear_checked_items();
                    this.refresh();
                  });
                }
              );
            }
          },
          standard: true
        };
      };
      const bulk_submit = () => {
        return {
          label: __("Submit", null, "Button in list view actions menu"),
          action: () => {
            const docnames = this.get_checked_items(true);
            if (docnames.length > 0) {
              frappe.confirm(
                __(
                  "Submit {0} documents?",
                  [docnames.length],
                  "Title of confirmation dialog"
                ),
                () => {
                  this.disable_list_update = true;
                  bulk_operations.submit_or_cancel(docnames, "submit", () => {
                    this.disable_list_update = false;
                    this.clear_checked_items();
                    this.refresh();
                  });
                }
              );
            }
          },
          standard: true
        };
      };
      const bulk_edit = () => {
        return {
          label: __("Edit", null, "Button in list view actions menu"),
          action: () => {
            let field_mappings = {};
            frappe.meta.get_docfields(doctype).forEach((field_doc) => {
              if (is_field_editable(field_doc)) {
                field_mappings[field_doc.label] = Object.assign({}, field_doc);
              }
            });
            this.disable_list_update = true;
            bulk_operations.edit(this.get_checked_items(true), field_mappings, () => {
              this.disable_list_update = false;
              this.refresh();
            });
          },
          standard: true
        };
      };
      const bulk_export = () => {
        return {
          label: __("Export", null, "Button in list view actions menu"),
          action: () => {
            const docnames = this.get_checked_items(true);
            bulk_operations.export(doctype, docnames);
          },
          standard: true
        };
      };
      if (has_editable_fields(doctype) && is_bulk_edit_allowed(doctype)) {
        actions_menu_items.push(bulk_edit());
      }
      actions_menu_items.push(bulk_export());
      actions_menu_items.push(bulk_assignment());
      actions_menu_items.push(bulk_assignment_clear());
      actions_menu_items.push(bulk_assignment_rule());
      actions_menu_items.push(bulk_add_tags());
      if (frappe.model.can_print(doctype)) {
        actions_menu_items.push(bulk_printing());
      }
      if (frappe.model.is_submittable(doctype) && has_submit_permission(doctype) && !frappe.model.has_workflow(doctype)) {
        actions_menu_items.push(bulk_submit());
      }
      if (frappe.model.can_cancel(doctype) && !frappe.model.has_workflow(doctype)) {
        actions_menu_items.push(bulk_cancel());
      }
      if (frappe.model.can_delete(doctype) && is_bulk_edit_allowed(doctype)) {
        actions_menu_items.push(bulk_delete());
      }
      return actions_menu_items;
    }
  };
})();
//# sourceMappingURL=bulk_edit.bundle.JDH3YTNX.js.map
