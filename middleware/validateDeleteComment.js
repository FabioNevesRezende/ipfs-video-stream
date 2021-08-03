const { body, validationResult } = require('express-validator');

module.exports = [
    body('commentId').exists().isInt({min: 1, max: 2147483648}).escape().trim(),
    function(req,res,next) { 
        console.log('running middleware validate delete comment ')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        next()
    }   
]