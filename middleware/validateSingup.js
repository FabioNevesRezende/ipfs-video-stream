const { body, validationResult } = require('express-validator');

module.exports = [
    body('username').exists().isLength({ max: 25 }).withMessage('Maximum size 25 chars').trim().escape(),
    body('email').exists().isEmail().normalizeEmail(),
    body('password').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('passwordConfirm').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    function(req,res,next) { 
        console.log('running middleware validate singup')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }
        if(req.body.password !== req.body.passwordConfirm){
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Passwords do not match' }});

        }

        next()
    }   
]