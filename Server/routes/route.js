const express = require("express");
const route = express.Router();
const controller = require("../controller/controller");
const services = require("../services/render");

route.get("/", services.homeRouter);
route.get("/video_chat", services.videoRouter);
route.get("/text_chat", services.chatRouter);
route.post("/api/users", controller.create);
route.put("/leaving-user-update/:id", controller.leavingUserUpdate);
route.put("/new-user-update/:id", controller.newUserUpdate);

module.exports = route;
