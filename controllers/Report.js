const {Report} = require('../persistence/models')

const postDeleteReport = async (req, res) => {
    try {
        await Report.delete(req.body.id)

        return res.status(200).json({})
                    
    } catch(err) {
        console.log('app.post/deleteReport error ' + err)
        return res.status(400).json({})
    }
}

module.exports = {
    postDeleteReport
}