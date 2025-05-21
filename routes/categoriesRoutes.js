const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/auth');

/**
 * GET /categories
 * Display all categories with their total expenses
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { Category, Expense } = req.app.locals.models;
    const categories = await Category.find({ user: req.user._id }).lean();
    
    // Get total expenses per category
    const categoryExpenses = await Expense.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } }
    ]);
    
    // Merge category data with expense totals
    const categoriesWithExpenses = categories.map(category => {
      const expenseData = categoryExpenses.find(item => 
        item._id && category._id && item._id.toString() === category._id.toString());
      return {
        ...category,
        totalExpenses: expenseData ? expenseData.total : 0
      };
    });
    
    res.render('pages/categories/index', {
      title: 'Categories',
      currentPath: req.path,
      categories: categoriesWithExpenses
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    req.flash('error', 'Failed to fetch categories');
    res.redirect('/dashboard');
  }
});

/**
 * GET /categories/manage
 * Display category management page
 */
router.get('/manage', ensureAuthenticated, async (req, res) => {
  try {
    const { Category } = req.app.locals.models;
    const categories = await Category.find({ user: req.user._id }).lean();
    
    res.render('pages/categories/manage', {
      title: 'Manage Categories',
      currentPath: req.path,
      categories,
      category: {} // For the add form
    });
  } catch (err) {
    console.error('Error loading category management:', err);
    req.flash('error', 'Failed to load categories');
    res.redirect('/categories');
  }
});

/**
 * POST /categories
 * Create a new category
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { Category } = req.app.locals.models;
    const { name, color } = req.body;
    
    if (!name || name.trim() === '') {
      req.flash('error', 'Category name is required');
      return res.redirect('/categories/manage');
    }
    
    // Validate category name is unique for this user (case-insensitive)
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      user: req.user._id 
    });
    
    if (existingCategory) {
      req.flash('error', 'A category with this name already exists');
      return res.redirect('/categories/manage');
    }
    
    const newCategory = new Category({
      name: name.trim(),
      color: color || '#' + Math.floor(Math.random()*16777215).toString(16),
      user: req.user._id
    });
    
    await newCategory.save();
    req.flash('success', 'Category added successfully');
    res.redirect('/categories/manage');
  } catch (err) {
    console.error('Error adding category:', err);
    req.flash('error', 'Failed to add category');
    res.redirect('/categories/manage');
  }
});

/**
 * PUT /categories/:id
 * Update an existing category
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { Category } = req.app.locals.models;
    const { name, color } = req.body;
    
    if (!name || name.trim() === '') {
      req.flash('error', 'Category name is required');
      return res.redirect('/categories/manage');
    }
    
    // Check if new name conflicts with another category (case-insensitive)
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      user: req.user._id,
      _id: { $ne: req.params.id }
    });
    
    if (existingCategory) {
      req.flash('error', 'A category with this name already exists');
      return res.redirect('/categories/manage');
    }
    
    await Category.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { name: name.trim(), color }
    );
    
    req.flash('success', 'Category updated successfully');
    res.redirect('/categories/manage');
  } catch (err) {
    console.error('Error updating category:', err);
    req.flash('error', 'Failed to update category');
    res.redirect('/categories/manage');
  }
});

/**
 * DELETE /categories/:id
 * Delete a category if it's not used in any expenses
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { Category, Expense } = req.app.locals.models;
    
    // Check if category exists and belongs to the user
    const category = await Category.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!category) {
      req.flash('error', 'Category not found');
      return res.redirect('/categories/manage');
    }
    
    // Check if category is used in expenses
    const expenseCount = await Expense.countDocuments({ 
      category: req.params.id,
      user: req.user._id
    });
    
    if (expenseCount > 0) {
      req.flash('error', `Cannot delete category - it is used in ${expenseCount} expenses`);
      return res.redirect('/categories/manage');
    }
    
    await Category.findOneAndDelete({ 
      _id: req.params.id,
      user: req.user._id
    });
    
    req.flash('success', 'Category deleted successfully');
    res.redirect('/categories/manage');
  } catch (err) {
    console.error('Error deleting category:', err);
    req.flash('error', 'Failed to delete category');
    res.redirect('/categories/manage');
  }
});

module.exports = router;