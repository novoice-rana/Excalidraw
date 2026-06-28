import { prismaClient } from '@repo/db/client';


import { CreateRoomSchema ,CreateUserSchema,SigninSchema} from "@repo/common/types";


import express  from "express";
import jwt from "jsonwebtoken";

import { middleware } from "./middleware";
import { JWT_SECRET } from '@repo/backend-common/config';




const app=express();
app.use(express.json());

app.post("/signup",async (req,res)=>{
   const parsedData =CreateUserSchema.safeParse(req.body);
   if(!parsedData.success){
    return res.json({
        message:"Incorrect inputs"
    })
    
   }
   try {
     const user= await prismaClient.User.create({
    data:{
        email:parsedData.data?.username,
        password:parsedData.data.password,
        name:parsedData.data.name
    }
   })
   res.json({
    userId:user.id
   })
    
   } catch (error) {
    res.status(403).json({
        message:"User email already exist"
    })

    
   }
   
  


})

app.post("/signin",(req,res)=>{


     const data =SigninSchema.safeParse(req.body);
   if(!data.success){
    return res.json({
        message:"Incorrect inputs"
    })
   }
    const userId =1;
   const token = jwt.sign({
        userId
    },JWT_SECRET);
    res.json({
        token
    })
    
})

app.post("/room",middleware,(req,res)=>{

     const data =CreateRoomSchema.safeParse(req.body);
   if(!data.success){
    return res.json({
        message:"Incorrect inputs"
    })
   }
    res.json({
        roomId:123
    })
    
})
app.listen(3003);