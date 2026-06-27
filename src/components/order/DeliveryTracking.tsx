import { useEffect, useState } from "react";
import DeliveryTimeline from "./DeliveryTimeline";
import CourierCard from "./CourierCard";
import RatingForm from "./RatingForm";
import { useDeliveryEta } from "../../hooks/useDeliveryEta";
import { getOrderCourier, type CourierInfo, type Order } from "../../services/gizApi";

type Props = { order: Order; onChat: () => void };

export default function DeliveryTracking({ order, onChat }: Props) {
  const inTransit = order.status === 3;
  const delivered = order.status === 4;
  const { etaMinutes } = useDeliveryEta(order.id, inTransit);
  const [courier, setCourier] = useState<CourierInfo | null>(null);

  useEffect(() => {
    if (order.status >= 3 && order.status <= 4) {
      getOrderCourier(order.id).then(setCourier);
    }
  }, [order.id, order.status]);

  return (
    <div className="space-y-3">
      {inTransit && etaMinutes !== null && (
        <div className="rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#2563eb] p-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Tempo estimado</p>
          <p className="text-2xl font-black">~{etaMinutes} min</p>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4">
        <DeliveryTimeline status={order.status} etaMinutes={etaMinutes} />
      </div>

      {courier && <CourierCard courier={courier} onChat={onChat} />}

      {delivered && <RatingForm orderId={order.id} />}
    </div>
  );
}
