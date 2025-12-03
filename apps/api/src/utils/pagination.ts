export interface PaginationOptions {
  defaultPage?: number;
  defaultPageSize?: number;
  maxPageSize?: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class PaginationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaginationError";
  }
}

export function parsePaginationParams(
  pageValue?: string | null,
  pageSizeValue?: string | null,
  options: PaginationOptions = {}
): PaginationParams {
  const defaultPage = options.defaultPage ?? DEFAULT_PAGE;
  const defaultPageSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize ?? MAX_PAGE_SIZE;

  const parsedPage = pageValue ? Number(pageValue) : defaultPage;
  const parsedPageSize = pageSizeValue ? Number(pageSizeValue) : defaultPageSize;

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw new PaginationError("page must be a positive integer");
  }

  if (!Number.isInteger(parsedPageSize) || parsedPageSize < 1) {
    throw new PaginationError("pageSize must be a positive integer");
  }

  const pageSize = Math.min(parsedPageSize, maxPageSize);
  const page = parsedPage;

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function buildPaginationMetadata(
  params: PaginationParams,
  total: number
): PaginationMetadata {
  const totalPages =
    total === 0 ? 0 : Math.ceil(total / Math.max(params.pageSize, 1));

  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
  };
}
