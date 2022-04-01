const {Comment} = require('../persistence/models')

const {goPage} = require('./Root')


const postComment = async (req, res) => {
    try {
        let comment = await Comment.createNew(req.body.commentText, req.user.id, req.body.cid)
        if(comment){
            res.redirect(req.header('Referer') || '/')
        }
        else {
            throw new Error('Invalid comment')
        }
        
    } catch(err) {
        console.log('app.post/comment error ' + err)
        return goPage('error', req, res, { errorMessage: 'Error creating new comment' })
    }
}

const postDeleteComment = async (req, res) => {
    try{
        if(req.user.adminLevel > 0){
            await Comment.removeById(req.body.commentId) 
            res.redirect(req.header('Referer') || '/')
            return
        }
        await Comment.remove(req.body.commentId, req.user.id) 
        res.redirect(req.header('Referer') || '/')

    } catch(err){
        console.log('app.post/deleteComment error ' + err)
        return goPage('error', req, res, { errorMessage: 'Error deleting comment' })
    }
}

module.exports = {
    postComment, postDeleteComment
}