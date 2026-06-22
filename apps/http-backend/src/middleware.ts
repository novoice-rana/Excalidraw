import  jwt ,{ JwtPayload}from 'jsonwebtoken';  
import { NextFunction,Request,Response } from "express";

import { JWT_SECRET } from "./config";

export function middleware(req:Request,res:Response,next:NextFunction){
    const token =(req.headers["authorizaton"] as string) ||" ";
    
const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if(decoded.userId){
        //@ts-ignore TODO :FIx this ?
        req.userId=decoded.userId;

    }else{
        res.status(403).json({
            message:"Unauthorised"
        })
    }

}