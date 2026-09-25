import { createFileRoute } from "@tanstack/react-router";

import { BorrowPage } from "@/components/borrow-page";

export const Route = createFileRoute("/demo/borrow")({ component: BorrowPage });
