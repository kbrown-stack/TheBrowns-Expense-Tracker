const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");
const { ensureAuthenticated } = require('../middlewares/auth');

// GET : To View all Expense , which will carry pagination and filters. 

router.get('/', ensureAuthenticated, expenseController.getExpenses);

// ADD: This is to display expense form.

router.get('/add', ensureAuthenticated, expenseController.getAddExpense);

// POST: This handles new expense submission

router.post('/add', ensureAuthenticated, expenseController.postAddExpense);

//GET: This helps display edit of the expense form

router.get('/edit/:id', ensureAuthenticated, expenseController.getEditExpense);

//POST: This helps to update the expense form.

router.post('/edit/:id', ensureAuthenticated, expenseController.updateExpense);

//DELETE: This handles the deletion.

router.post('/delete/:id', ensureAuthenticated, expenseController.deleteExpense);

module.exports = router;
