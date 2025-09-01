# 🔢 Formula Based Bulk Update for ERPNext

A handy little extension to make bulk updates in ERPNext more powerful 🚀.
Instead of entering only static values, now you can apply formulas directly while updating fields.

https://github.com/user-attachments/assets/32aff3bb-e513-4c82-9165-bcbdb8da5ad3


## ✨ What You Can Do
✅ Perform quick arithmetic operations on existing values

✅ Reference the current field value with current

✅ Avoid repetitive manual updates during bulk changes


## 🛠️ Usage Examples

| Input Formula | Effect | Example (if `current = 1000`) |
|---------------|--------|-------------------------------|
| `=*1.1`       | Multiply current value by 1.1 | → **1100** |
| `=+500`       | Add 500 to current value | → **1500** |
| `=-200`       | Subtract 200 from current value | → **800** |
| `=/2`         | Divide current value by 2 | → **500** |
| `=%3`         | Take remainder when dividing by 3 | → **1** |
| `=(current+1000)*1.05` | Custom formula with `current` reference | → **2100** |


## 🚀 Getting Started

1. Get the app & Install on your site:  
   ```bash
    $ bench get-app https://github.com/manavmandli/bulk_edit_formula.git
   
    $ bench --site yoursite install-app bulk_edit_formula
   
2. Add the helper function into your custom app or script

3. Use =your_formula in bulk update — and watch the magic happen 🎉


## 🙌 Contribute

Have an idea to extend this (like supporting multiple fields, or advanced operators)?
PRs and feedback are always welcome ✨

## 🔗 Connect

If you find this useful, ⭐ the repo and share your experience — it really helps!
