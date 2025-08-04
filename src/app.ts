import express, { Application, NextFunction, Request, Response } from "express";
import ordersRouter from "./routes/orders";

const app: Application = express();

app.use(express.json());
app.use("/orders", ordersRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

export default app;
