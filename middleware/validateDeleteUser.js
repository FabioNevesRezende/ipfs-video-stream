const { body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    body('id').exists().isInt({min: 0, max: 25000000000 }).withMessage('Integer out of range').trim().escape(),
    body('password').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    function(req,res,next) { 
        console.log('running middleware validate delete user')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]