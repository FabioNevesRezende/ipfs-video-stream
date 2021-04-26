const { body, validationResult } = require('express-validator');

module.exports = [
    body('password').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('newPassword').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('newPasswordConfirm').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    function(req,res,next) { 
        console.log('running middleware validate change password')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        if(req.body.newPassword !== req.body.newPasswordConfirm){
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'New Passwords do not match' }});

        }

        next()
    }   
]