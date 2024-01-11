import { body, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateReportCid = [
    body('type').exists().isInt({ min: 0, max: 15 }).withMessage('Maximum type is 2').trim().escape(),
    body('cid').exists().isLength({ max: 46, min: 46 }).trim().escape().withMessage('Invalid Cid'),
    function(req,res,next) { 
        console.log('running middleware validate report')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateReportCid