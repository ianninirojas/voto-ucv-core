// modules
import { Router } from "express";

// controllers
import TypeElectorController from "../controllers/TypeElectorController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/type-elector", TypeElectorController.getAll);

// router.post("/type-elector", [checkJwt, checkRole(["ADMIN"])], TypeElectorController.create);
router.post("/type-elector", TypeElectorController.create);

// router.put("/type-elector/:id", [checkJwt, checkRole(["ADMIN"])], TypeElectorController.update);
router.put("/type-elector/:id", TypeElectorController.update);

// router.delete("/type-elector/:id, [checkJwt, checkRole(["ADMIN"])], TypeElectorController.delete);
router.delete("/type-elector/:id", TypeElectorController.delete);


export default router;