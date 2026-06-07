export type UserFacingErrorAction = {
  href: string;
  label: string;
};

export type UserFacingError = {
  message: string;
  action?: UserFacingErrorAction;
};
