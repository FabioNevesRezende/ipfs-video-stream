const { body, validationResult } = require('express-validator');

module.exports = [
    body('cid').exists().isLength({ max: 46, min: 46 }).trim().escape().withMessage('Maximum size 46 chars'),
    function(req,res,next) { 
        console.log('running middleware validate delete file ')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        next()
    }   
]