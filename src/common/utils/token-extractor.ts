export function extractTokenFromRequest(req: any): string | null {
  // Log để debug
  console.log('Headers:', req.headers);
  console.log('Cookies:', req.cookies);

  // Thứ tự ưu tiên: Authorization header > Cookie > Query param

  // Kiểm tra Authorization header (thường được dùng bởi Swagger UI)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Cắt phần "Bearer "
    console.log('Token from Authorization header:', token);
    return token;
  }

  // Kiểm tra Cookie
  if (req.cookies && req.cookies.accessToken) {
    console.log('Token from cookie:', req.cookies.accessToken);
    return req.cookies.accessToken;
  }

  // Kiểm tra query param (đôi khi được dùng cho các API public)
  if (req.query && req.query.access_token) {
    console.log('Token from query param:', req.query.access_token);
    return req.query.access_token;
  }

  console.log('No token found in request');
  return null;
}
