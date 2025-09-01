🔢 Formula Based Bulk Update for ERPNext

A handy little extension to make bulk updates in ERPNext more powerful 🚀.
Instead of entering only static values, now you can apply formulas directly while updating fields.

🎥 Demo Video: Watch here

✨ What You Can Do

Perform quick arithmetic operations on existing values

Reference the current field value with current

Avoid repetitive manual updates during bulk changes

🛠️ Usage Examples
Input Formula	Effect	Example (if current = 1000)
=*1.1	Multiply current value by 1.1	→ 1100
=+500	Add 500 to current value	→ 1500
=-200	Subtract 200 from current value	→ 800
=/2	Divide current value by 2	→ 500
=%3	Take remainder when dividing by 3	→ 1
=(current+1000)*1.05	Custom formula with current reference	→ 2100
🚀 Getting Started

Clone this repo

git clone https://github.com/yourusername/formula-bulk-update.git


Add the helper function into your custom app or script

Use =your_formula in bulk update — and watch the magic happen 🎉

🙌 Contribute

Have an idea to extend this (like supporting multiple fields, or advanced operators)?
PRs and feedback are always welcome ✨

🔗 Connect

If you find this useful, ⭐ the repo and share your experience — it really helps!
