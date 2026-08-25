import { encodeCode39 } from "@/features/lucky-draw/helpers/code39Barcode";

interface OrderBarcodeProps {
    value: string;
    height?: number;
}

const OrderBarcode: React.FC<OrderBarcodeProps> = ({ value, height = 44 }) => {
    const barcode = encodeCode39(value);
    return (
        <svg
            role="img"
            aria-label={`Mã vạch đơn hàng ${value}`}
            viewBox={`0 0 ${barcode.width} ${height}`}
            preserveAspectRatio="none"
            style={{ display: "block", width: "100%", height, paddingInline: "20px" }}
        >
            <title>Mã vạch đơn hàng {value}</title>
            <rect width={barcode.width} height={height} fill="#fff" />
            {barcode.bars.map((bar, index) => (
                <rect key={`${bar.x}-${index}`} x={bar.x} width={bar.width} height={height} fill="#000" />
            ))}
        </svg>
    );
};

export default OrderBarcode;
