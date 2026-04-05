export const getDefaultRouteForRole = (role) => {
  switch (role) {
    case "admin":
      return "/admin";
    case "police":
      return "/police-dashboard";
    case "driver":
      return "/driver-dashboard";
    case "user":
    default:
      return "/dashboard";
  }
};
