export interface LotResult {
    lot_source_link: string;
    lot_code: string | null;
    lot_title?: string | null;
    lot_description?: string | null;
    lot_media?: string[];

    vehicle_chassis_no: string | null;
    vehicle_make?: string | null;
    vehicle_model?: string | null;
    vehicle_year?: number | null;
    vehicle_transmission_type?: string | null;
    vehicle_steering_position?: string | null;
    vehicle_body_color?: string | null;
    vehicle_interior_color?: string | null;
    vehicle_convertible?: boolean;
    vehicle_registry_code?: string | null;
    vehicle_mileage_value?: number | null;
    vehicle_mileage_unit?: string | null;
    vehicle_mileage_unit_unknown?: boolean;
    vehicle_engine?: string | null;

    price_type?: string | null;
    price_value?: number | null;
    price_currency?: string | null;
    price_guide_low?: number | null;
    price_guide_high?: number | null;

    auction_label?: string | null;
    auction_date_range?: string | null;
}
