create index customers_created_by_idx on public.customers (created_by);
create index suppliers_created_by_idx on public.suppliers (created_by);
create index products_created_by_idx on public.products (created_by);
create index sales_orders_created_by_idx on public.sales_orders (created_by);
create index sales_order_lines_product_idx on public.sales_order_lines (product_id);
create index purchase_orders_created_by_idx on public.purchase_orders (created_by);
create index purchase_orders_customer_idx on public.purchase_orders (customer_id);
create index purchase_order_lines_product_idx on public.purchase_order_lines (product_id);