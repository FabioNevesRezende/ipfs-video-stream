const { body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    body('password').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('passwordConfirm').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('passwordResetToken').exists().trim(),
    function(req,res,next) { 
        console.log('running middleware validate forgot password')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        if(req.body.password && req.body.passwordConfirm && (req.body.password !== req.body.passwordConfirm)){
            return goPage('error', req, res, { errorMessage: 'Passwords do not match' }, 400 )

        }

        next()
    }   
]