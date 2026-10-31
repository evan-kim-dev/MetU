/** Agoda 제휴 CID/TAG. env 가 있으면 우선, 없으면 기본값. */
const DEFAULT_AGODA_CID = "1922887";
const DEFAULT_AGODA_TAG = "f7739694-dbb7-41bd-aa27-be7c942ce354";

export const AGODA_CID =
  process.env.AGODA_CID?.trim() || DEFAULT_AGODA_CID;

export const AGODA_TAG =
  process.env.AGODA_TAG?.trim() || DEFAULT_AGODA_TAG;
