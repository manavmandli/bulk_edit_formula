import CustomBulkOperations from "./bulk_operations";

frappe.views.ListView = class ListView extends frappe.views.ListView {
    get_actions_menu_items() {
		const doctype = this.doctype;
		const actions_menu_items = [];
		const bulk_operations = new CustomBulkOperations({ doctype: this.doctype });

		const is_field_editable = (field_doc) => {
			return (
				field_doc.fieldname &&
				frappe.model.is_value_type(field_doc) &&
				field_doc.fieldtype !== "Read Only" &&
				!field_doc.hidden &&
				!field_doc.read_only &&
				!field_doc.is_virtual
			);
		};

		const has_editable_fields = (doctype) => {
			return frappe.meta
				.get_docfields(doctype)
				.some((field_doc) => is_field_editable(field_doc));
		};

		const has_submit_permission = (doctype) => {
			return frappe.perm.has_perm(doctype, 0, "submit");
		};

		const is_bulk_edit_allowed = (doctype) => {
			// Check settings if there is a workflow defined, otherwise directly allow
			if (frappe.model.has_workflow(doctype)) {
				return !!this.list_view_settings?.allow_edit;
			}
			return true;
		};

		// utility
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
				standard: true,
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
				standard: true,
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
				standard: true,
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
				standard: true,
			};
		};

		const bulk_printing = () => {
			return {
				label: __("Print", null, "Button in list view actions menu"),
				action: () => bulk_operations.print(this.get_checked_items()),
				standard: true,
			};
		};

		const bulk_delete = () => {
			return {
				label: __("Delete", null, "Button in list view actions menu"),
				action: () => {
					const docnames = this.get_checked_items(true).map((docname) =>
						docname.toString()
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
				standard: true,
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
				standard: true,
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
				standard: true,
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
				standard: true,
			};
		};

		const bulk_export = () => {
			return {
				label: __("Export", null, "Button in list view actions menu"),
				action: () => {
					const docnames = this.get_checked_items(true);

					bulk_operations.export(doctype, docnames);
				},
				standard: true,
			};
		};

		// bulk edit
		if (has_editable_fields(doctype) && is_bulk_edit_allowed(doctype)) {
			actions_menu_items.push(bulk_edit());
		}

		actions_menu_items.push(bulk_export());

		// bulk assignment
		actions_menu_items.push(bulk_assignment());

		actions_menu_items.push(bulk_assignment_clear());

		actions_menu_items.push(bulk_assignment_rule());

		actions_menu_items.push(bulk_add_tags());

		// bulk printing
		if (frappe.model.can_print(doctype)) {
			actions_menu_items.push(bulk_printing());
		}

		// bulk submit
		if (
			frappe.model.is_submittable(doctype) &&
			has_submit_permission(doctype) &&
			!frappe.model.has_workflow(doctype)
		) {
			actions_menu_items.push(bulk_submit());
		}

		// bulk cancel
		if (frappe.model.can_cancel(doctype) && !frappe.model.has_workflow(doctype)) {
			actions_menu_items.push(bulk_cancel());
		}

		// bulk delete
		if (frappe.model.can_delete(doctype) && is_bulk_edit_allowed(doctype)) {
			actions_menu_items.push(bulk_delete());
		}

		return actions_menu_items;
	}
}