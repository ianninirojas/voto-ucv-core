// modules
import { Router } from "express";

// controllers
import UserController from "../controllers/UserController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/user", UserController.getAll);

router.post("/user", [checkJwt, checkRole(["ADMIN"])], UserController.create);

router.put("/user/:id", [checkJwt, checkRole(["ADMIN"])], UserController.update);

router.delete("/user/:id", [checkJwt, checkRole(["ADMIN"])], UserController.delete);


export default router;