const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const { ensureAuthenticated } = require('../middlewares/auth');

// Get Budgets 

router.get('/', ensureAuthenticated, budgetController.getBudgets);

// To Add a new Budget

router.post('/add', ensureAuthenticated, budgetController.postAddBudget);

// To Update Budget

router.put('/edit/:id', ensureAuthenticated, budgetController.updateBudget);

// To Delete Budget 

router.delete('/delete/:id', ensureAuthenticated, budgetController.deleteBudget);

//To get Budget from previous months, week or years.

router.post('/copy', ensureAuthenticated, budgetController.copyPreviousBudgets);


module.exports = router;