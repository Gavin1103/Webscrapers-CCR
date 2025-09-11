export const LINK_SELECTOR = 'a[class^="CardLot_title__"]'; // lot-kaarten
export const DETAIL_CONTAINER = "div.LotHeader_odometerSerial__4U5fu";
export const LOT_NUMBER_SELECTOR = "span.LotHeader_num__xqgKs";
export const LOT_TITLE = "h1.LotHeader_title__UCXNK";
export const LOT_DESCRIPTION = "ul.List_list__xS3rG.List_ul__hcY__ li";

export const PRICE_SELECTORS = [
    'div.PriceBadge_priceBadge__1Xlj8',
    'div.LotHeader_priceBadge__UkPub',
    'div[class*="PriceBadge_"][class*="priceBadge"]',
    'div[class*="LotHeader_"][class*="priceBadge"]',
    'div[class*="priceBadge"]'
];

export const SOLD_BADGE = "img.soldBadge";

// has view all button
export const VIEW_ALL_IMAGES_BUTTON = "button.ImageGallery_viewAllButton___7Lil";
export const VIEW_ALL_IMAGES_OVERLAY = "div.ImageGallery_gridOverlay__WKz6u div";
export const VEHICLE_IMAGES_IN_OVERLAY = "div.ImageGallery_gridOverlay__WKz6u div button span img";

// does not have a view all button
export const VEHICLE_IMAGES_SECTION = "div.Group_group__fEouc section.ImageGallery_imageGallery__MXeFA";
export const VEHICLE_IMAGES_BUTTON_IN_SECTION = "div.ImageGallery_gridGallery__nUm41.grid-gallery button";
export const VEHICLE_OVERLAY_AFTER_CLICKING_BUTTON = "div.pswp__item div.pswp__zoom-wrap";
// export const VEHICLE_IMAGE_AFTER_CLICKING_BUTTON = "div.pswp__item div.pswp__zoom-wrap img.pswp__img";

export const VEHICLE_OVERLAY_ROOT = "div.pswp";
export const VEHICLE_IMAGE_AFTER_CLICKING_BUTTON =
  ".pswp__item[aria-hidden='false'] img.pswp__img"; // ← actieve slide image'