// This is the controller for all business logic for the authentication.

const bcrypt = require('bcryptjs');
const passport = require('passport');
const User = require('../models/User');
const Family = require('../models/Family');

// Display login form
exports.getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Login',
    layout: 'layouts/auth'
  });
};

// Handle login form submission
exports.postLogin = (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/auth/login',
    failureFlash: true
  })(req, res, next);
};

// Display registration form
exports.getRegister = (req, res) => {
  res.render('auth/register', {
    title: 'Register',
    layout: 'layouts/auth'
  });
};

// Handle registration form submission
exports.postRegister = async (req, res) => {
  const { name, email, password, password2 } = req.body;
  let errors = [];

  // Check required fields
  if (!name || !email || !password || !password2) {
    errors.push({ msg: 'Please fill in all fields' });
  }

  // Check passwords match
  if (password !== password2) {
    errors.push({ msg: 'Passwords do not match' });
  }

  // Check password length
  if (password.length < 6) {
    errors.push({ msg: 'Password should be at least 6 characters' });
  }

  if (errors.length > 0) {
    res.render('auth/register', {
      title: 'Register',
      layout: 'layouts/auth',
      errors,
      name,
      email
    });
  } else {
    try {
      // Check if email already exists
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        errors.push({ msg: 'Email is already registered' });
        return res.render('auth/register', {
          title: 'Register',
          layout: 'layouts/auth',
          errors,
          name,
          email
        });
      }

      // Create new user
      const newUser = new User({
        name,
        email,
        password,
        role: 'admin' // First user is admin
      });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      newUser.password = await bcrypt.hash(password, salt);
      
      // Create family for the user
      const newFamily = new Family({
        name: `${name}'s Family`,
        admin: newUser._id,
        members: [newUser._id]
      });

      await newFamily.save();
      
      // Update user with family ID
      newUser.familyId = newFamily._id;
      await newUser.save();

      req.flash('success_msg', 'You are now registered and can log in');
      res.redirect('/auth/login');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'An error occurred during registration');
      res.redirect('/auth/register');
    }
  }
};

// Handle logout
exports.logout = (req, res) => {
  req.logout(function(err) {
    if (err) { 
      console.error(err);
      return next(err); 
    }
    req.flash('success_msg', 'You are logged out');
    res.redirect('/auth/login');
  });
};

// Display profile page
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.render('auth/profile', {
      title: 'Your Profile',
      user
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error retrieving profile');
    res.redirect('/dashboard');
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  const { name, email } = req.body;
  try {
    await User.findByIdAndUpdate(req.user.id, {
      name,
      email
    });
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/auth/profile');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error updating profile');
    res.redirect('/auth/profile');
  }
};

// Change password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  
  try {
    // Find user
    const user = await User.findById(req.user.id);
    
    // Check if current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      req.flash('error_msg', 'Current password is incorrect');
      return res.redirect('/auth/profile');
    }
    
    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      req.flash('error_msg', 'New passwords do not match');
      return res.redirect('/auth/profile');
    }
    
    // Check password length
    if (newPassword.length < 6) {
      req.flash('error_msg', 'Password should be at least 6 characters');
      return res.redirect('/auth/profile');
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    user.password = hashedPassword;
    await user.save();
    
    req.flash('success_msg', 'Password changed successfully');
    res.redirect('/auth/profile');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error changing password');
    res.redirect('/auth/profile');
  }
};