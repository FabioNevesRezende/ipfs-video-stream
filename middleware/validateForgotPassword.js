const { body, validationResult } = require('express-validator');

module.exports = [
    body('password').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('passwordConfirm').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('passwordResetToken').exists().trim(),
    function(req,res,next) { 
        console.log('running middleware validate forgot password')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        if(req.body.password && req.body.passwordConfirm && (req.body.password !== req.body.passwordConfirm)){
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Passwords do not match' }});

        }

        next()
    }   
]