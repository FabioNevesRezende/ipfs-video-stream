const { body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    body('username').exists().isLength({ max: 25 }).withMessage('Maximum size 25 chars').trim().escape(),
    body('email').exists().isEmail().normalizeEmail().trim().escape(),
    body('password').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    function(req,res,next) { 
        console.log('running middleware validate change user data')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]