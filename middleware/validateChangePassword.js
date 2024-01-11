import { body, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateChangePassword = [
    body('password').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('newPassword').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    body('newPasswordConfirm').exists().isLength({ min: 8, max: 25 }).withMessage('Password minimum 8 maximum 25'),
    function(req,res,next) { 
        console.log('running middleware validate change password')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        if(req.body.newPassword !== req.body.newPasswordConfirm){
            return goPage('error', req, res, { errorMessage: 'New Passwords do not match' }, 400 )

        }

        next()
    }   
]

export default validateChangePassword