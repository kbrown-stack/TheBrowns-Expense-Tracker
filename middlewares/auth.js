// This file creats the the authentication middleware.

module.exports = {
    ensureAuthenticated: function(req, res, next) {
      if (req.isAuthenticated()) {
        return next();
      }
      req.flash('error_msg', 'Please log in to view this resource');
      res.redirect('/auth/login');
    },
    
    forwardAuthenticated: function(req, res, next) {
      if (!req.isAuthenticated()) {
        return next();
      }
      res.redirect('/dashboard');
    },
    
    isAdmin: function(req, res, next) {
      if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
      }
      req.flash('error_msg', 'You need admin privileges to view this page');
      res.redirect('/dashboard');
    }
  };