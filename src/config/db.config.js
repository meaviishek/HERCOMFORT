import { prisma } from "./prisma";

export const connectDB = {
async connectPrismaToDB(){
    try {
        await prisma.$connect();
        console.log("Database connected");
    } catch (error) {
        console.log(error);
    }
}

}
