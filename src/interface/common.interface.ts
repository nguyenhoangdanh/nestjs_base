export type ReturnDataType<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type PromiseReturnDataType<T> = Promise<ReturnDataType<T>>;

export const PromiseReturnData = <T>(
  response: ReturnDataType<T>,
): PromiseReturnDataType<T> => {
  return new Promise((resolve) => {
    resolve(response);
  });
};
