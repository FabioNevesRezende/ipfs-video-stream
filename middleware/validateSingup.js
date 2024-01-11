import { body, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateSingUp = [
    body('username').exists().isLength({ max: 25 }).withMessage('Maximum size 25 chars').trim().escape(),
    body('email').exists().isEmail().normalizeEmail().trim().escape(),
    body('password').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('passwordConfirm').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    function(req,res,next) { 
        console.log('running middleware validate singup')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }
        if(req.body.password !== req.body.passwordConfirm){
            return goPage('error', req, res, { errorMessage: 'Passwords do not match' }, 400 )

        }

        next()
    }   
]

export default validateSingUp