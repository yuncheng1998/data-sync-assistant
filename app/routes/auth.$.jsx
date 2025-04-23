import { enhancedAuthentication } from "../middleware/authMiddleware";

export const loader = async ({ request }) => {
  await enhancedAuthentication.admin(request);

  return null;
};
