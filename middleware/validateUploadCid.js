import { body, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateUploadCid = [
    body('fileName').exists().isLength({ max: 25 }).withMessage('Maximum fileName size 25 chars').trim().escape(),
    body('categories').exists().isLength({ max: 1024 }).withMessage('Maximum categories size 1024 chars').trim().escape(),
    body('description').exists().isLength({ max: 1024 }).withMessage('Maximum description size 1024 chars').trim().escape(),
    body('duration').exists().isLength({ max: 64 }).trim().escape().withMessage('Maximum duration size 64 chars'),
    body('cid').exists().isLength({ max: 46, min: 46 }).trim().escape().withMessage('Invalid Cid'),
    function(req,res,next) { 
        console.log('running middleware validate video input')
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateUploadCid