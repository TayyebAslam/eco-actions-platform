import { sendResponse } from "../../src/utils/helperFunctions/responseHelper";

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("sendResponse", () => {
  test("200 - success with data", () => {
    const res = mockResponse();
    sendResponse(res, 200, "Success", true, { id: 1 });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 200,
      success: true,
      data: { id: 1 },
      message: "Success",
    });
  });

  test("404 - error without data", () => {
    const res = mockResponse();
    sendResponse(res, 404, "Not found", false);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: 404,
      success: false,
      data: undefined,
      message: "Not found",
    });
  });

  test("500 - server error", () => {
    const res = mockResponse();
    sendResponse(res, 500, "Internal server error", false);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, success: false }),
    );
  });
});
