import { createBrowserRouter } from "react-router";
import { BookingPage } from "@/routes/BookingPage";
import { HomePage } from "@/routes/HomePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/book/:serviceId",
    element: <BookingPage />,
  },
]);
