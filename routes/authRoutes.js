const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { forwardAuthenticated } = require('../middlewares/auth');

// Login page
router.get('/login', forwardAuthenticated, (req, res) => {
  res.render('pages/auth/login', {
    title: 'Login',
    currentPath: req.path
  });
});

// Register page
router.get('/register', forwardAuthenticated, (req, res) => {
  res.render('pages/auth/register', {
    title: 'Register',
    currentPath: req.path
  });
});

// Register handle
router.post('/register', async (req, res) => {
  try {
    const { User } = req.app.locals.models;
    const { name, email, password, confirmPassword } = req.body;
    const errors = [];
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      errors.push({ msg: 'Please fill in all fields' });
    }
    
    if (password !== confirmPassword) {
      errors.push({ msg: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
      errors.push({ msg: 'Password should be at least 6 characters' });
    }
    
    if (errors.length > 0) {
      return res.render('pages/auth/register', {
        title: 'Register',
        currentPath: req.path,
        errors,
        name,
        email
      });
    }
    
    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      errors.push({ msg: 'Email is already registered' });
      return res.render('pages/auth/register', {
        title: 'Register',
        currentPath: req.path,
        errors,
        name,
        email
      });
    }
    
    // Create new user
    const newUser = new User({
      name,
      email,
      password
    });
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(password, salt);
    
    // Create a new family ID for the user
    newUser.familyId = new mongoose.Types.ObjectId();
    
    // Save user
    await newUser.save();
    
    // Create default categories for new user
    const { Category } = req.app.locals.models;
    const defaultCategories = [
      { name: 'Food & Dining', color: '#FF5733', user: newUser._id },
      { name: 'Transportation', color: '#33A8FF', user: newUser._id },
      { name: 'Housing', color: '#4CAF50', user: newUser._id },
      { name: 'Utilities', color: '#FFC107', user: newUser._id },
      { name: 'Entertainment', color: '#9C27B0', user: newUser._id },
      { name: 'Health & Medical', color: '#FF5252', user: newUser._id },
      { name: 'Education', color: '#3F51B5', user: newUser._id },
      { name: 'Shopping', color: '#E91E63', user: newUser._id },
      { name: 'Personal Care', color: '#00BCD4', user: newUser._id },
      { name: 'Others', color: '#607D8B', user: newUser._id }
    ];
    
    await Category.insertMany(defaultCategories);
    
    req.flash('success', 'You are now registered and can log in');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Registration error:', err);
    req.flash('error', 'Registration failed. Please try again.');
    res.redirect('/auth/register');
  }
});

// Login handle
router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/auth/login',
    failureFlash: true
  })(req, res, next);
});

// Logout handle
router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.flash('success', 'You are logged out');
    res.redirect('/auth/login');
  });
});

// Forgot password page
router.get('/forgot-password', forwardAuthenticated, (req, res) => {
  res.render('pages/auth/forgot-password', {
    title: 'Forgot Password',
    currentPath: req.path
  });
});

// Forgot password handle
router.post('/forgot-password', async (req, res) => {
  try {
    const { User } = req.app.locals.models;
    const { email } = req.body;
    
    // Check if email exists
    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error', 'Email not found');
      return res.redirect('/auth/forgot-password');
    }
    
    // In a real application, you would:
    // 1. Generate a password reset token
    // 2. Save it to the user document with an expiration
    // 3. Send an email with a reset link
    
    // For this demo, we'll just show a success message
    req.flash('success', 'Password reset instructions sent to your email');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Forgot password error:', err);
    req.flash('error', 'Failed to process password reset request');
    res.redirect('/auth/forgot-password');
  }
});

module.exports = router;