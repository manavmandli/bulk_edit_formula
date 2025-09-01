(() => {
  // ../bulk_edit_formula/bulk_edit_formula/public/js/bulk_operations.bundle.js
  var CustomBulkOperations = class extends frappe.views.BulkOperations {
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
            method: "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
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
  };
  frappe.views.BulkOperations = CustomBulkOperations;
})();
//# sourceMappingURL=bulk_operations.bundle.HIBGE7YV.js.map
