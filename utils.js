const isDebug = process.env.DEBUG === "TRUE"

export const goPage = async(page, req, res, args, httpCode=200) => {
    if(req.user && !args.user){
        args.user = req.user
    }
    if(page === "error" && httpCode === 200) httpCode = 500;
    return res.status(httpCode).render('main', {page, params: {...args, appname: process.env.APPNAME, isDebug }})
}