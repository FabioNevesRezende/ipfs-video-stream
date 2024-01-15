import { query, validationResult } from 'express-validator'
import {goPage} from '../utils.js'

const validateGetWatch = [
    // regex source: https://stackoverflow.com/a/67176726
    query('filehash').exists().matches(/Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[A-Za-z2-7]{58,}|B[A-Z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|F[0-9A-F]{50,}/).withMessage('Invalid cid'),
    function(req,res,next) { 
        console.log('running middleware handle get watch')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]

export default validateGetWatch