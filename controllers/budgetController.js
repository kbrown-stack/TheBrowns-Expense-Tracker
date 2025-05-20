// This is the controller for all business logic as regards to the budget.

const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Expense = require('../models/Expense');
const moment = require('moment');

// Display all budgets
exports.getBudgets = async (req, res) => {
  try {
    // Get query parameters for filtering
    const { month, year } = req.query;
    const currentMonth = parseInt(month) || moment().month() + 1;
    const currentYear = parseInt(year) || moment().year();
    
    // Fetch budgets for the selected month and year
    const budgets = await Budget.find({
      familyId: req.user.familyId,
      month: currentMonth,
      year: currentYear
    }).populate('category');
    
    // Get categories for adding new budgets
    const categories = await Category.find({
      familyId: req.user.familyId
    });
    
    // For each budget, calculate the current spending
    const budgetsWithSpending = await Promise.all(budgets.map(async (budget) => {
      const startOfMonth = moment(`${currentYear}-${currentMonth}-01`).startOf('month').toDate();
      const endOfMonth = moment(`${currentYear}-${currentMonth}-01`).endOf('month').toDate();
      
      const totalSpent = await Expense.aggregate([
        {
          $match: {
            category: budget.category._id,
            familyId: req.user.familyId,
            date: {
              $gte: startOfMonth,
              $lte: endOfMonth
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]);
      
      const spent = totalSpent[0]?.total || 0;
      const percentUsed = (spent / budget.amount) * 100;
      
      return {
        ...budget.toObject(),
        spent,
        remaining: budget.amount - spent,
        percentUsed: percentUsed.toFixed(1)
      };
    }));
    
    // Get months and years for filter dropdowns
    const months = Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      name: moment().month(i).format('MMMM')
    }));
    
    const years = [];
    const currentYearNum = moment().year();
    for (let i = currentYearNum - 2; i <= currentYearNum + 2; i++) {
      years.push(i);
    }
    
    res.render('budgets/index', {
      title: 'Budgets',
      budgets: budgetsWithSpending,
      categories,
      months,
      years,
      selectedMonth: currentMonth,
      selectedYear: currentYear,
      moment
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error fetching budgets');
    res.redirect('/dashboard');
  }
};

// Add new budget
exports.postAddBudget = async (req, res) => {
  try {
    const { category, amount, month, year, notifyThreshold } = req.body;
    
    // Basic validation
    if (!category || !amount || !month || !year) {
      req.flash('error_msg', 'Please fill in all required fields');
      return res.redirect('/budgets');
    }
    
    // Check if budget already exists for this category/month/year
    const existingBudget = await Budget.findOne({
      category,
      month,
      year,
      familyId: req.user.familyId
    });
    
    if (existingBudget) {
      req.flash('error_msg', 'Budget already exists for this category in the selected month');
      return res.redirect('/budgets');
    }
    
    // Create new budget
    const newBudget = new Budget({
      category,
      amount,
      month,
      year,
      familyId: req.user.familyId,
      createdBy: req.user.id,
      notifyThreshold: notifyThreshold || 80
    });
    
    await newBudget.save();
    
    req.flash('success_msg', 'Budget added successfully');
    res.redirect(`/budgets?month=${month}&year=${year}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error adding budget');
    res.redirect('/budgets');
  }
};

// Update budget
exports.updateBudget = async (req, res) => {
  try {
    const { amount, notifyThreshold } = req.body;
    const { id } = req.params;
    
    // Find budget
    const budget = await Budget.findOne({
      _id: id,
      familyId: req.user.familyId
    });
    
    if (!budget) {
      req.flash('error_msg', 'Budget not found');
      return res.redirect('/budgets');
    }
    
    // Update budget
    budget.amount = amount;
    budget.notifyThreshold = notifyThreshold || budget.notifyThreshold;
    
    await budget.save();
    
    req.flash('success_msg', 'Budget updated successfully');
    res.redirect(`/budgets?month=${budget.month}&year=${budget.year}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error updating budget');
    res.redirect('/budgets');
  }
};

// Delete budget
exports.deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find budget
    const budget = await Budget.findOne({
      _id: id,
      familyId: req.user.familyId
    });
    
    if (!budget) {
      req.flash('error_msg', 'Budget not found');
      return res.redirect('/budgets');
    }
    
    // Store month and year before deletion
    const { month, year } = budget;
    
    // Delete budget
    await budget.deleteOne();
    
    req.flash('success_msg', 'Budget deleted successfully');
    res.redirect(`/budgets?month=${month}&year=${year}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting budget');
    res.redirect('/budgets');
  }
};

// Copy budgets from previous month
exports.copyPreviousBudgets = async (req, res) => {
  try {
    const { month, year } = req.body;
    
    // Calculate previous month and year
    let prevMonth = parseInt(month) - 1;
    let prevYear = parseInt(year);
    
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    
    // Get budgets from previous month
    const previousBudgets = await Budget.find({
      familyId: req.user.familyId,
      month: prevMonth,
      year: prevYear
    });
    
    if (previousBudgets.length === 0) {
      req.flash('info_msg', 'No budgets found for the previous month');
      return res.redirect(`/budgets?month=${month}&year=${year}`);
    }
    
    // Copy each budget to the new month
    let copied = 0;
    for (const prevBudget of previousBudgets) {
      // Check if budget already exists
      const existingBudget = await Budget.findOne({
        category: prevBudget.category,
        month,
        year,
        familyId: req.user.familyId
      });
      
      if (!existingBudget) {
        // Create new budget with same values
        const newBudget = new Budget({
          category: prevBudget.category,
          amount: prevBudget.amount,
          month,
          year,
          familyId: req.user.familyId,
          createdBy: req.user.id,
          notifyThreshold: prevBudget.notifyThreshold
        });
        
        await newBudget.save();
        copied++;
      }
    }
    
    req.flash('success_msg', `${copied} budgets copied from previous month`);
    res.redirect(`/budgets?month=${month}&year=${year}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error copying budgets');
    res.redirect('/budgets');
  }
};