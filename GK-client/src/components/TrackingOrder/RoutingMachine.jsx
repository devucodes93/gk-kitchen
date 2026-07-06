import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const osrmServiceUrl = "https://router.project-osrm.org/route/v1";

function RoutingMachine({ restaurant, customer }) {
  const map = useMap();

  useEffect(() => {
    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(restaurant[0], restaurant[1]),
        L.latLng(customer[0], customer[1]),
      ],
      router: L.Routing.osrmv1({
        serviceUrl: osrmServiceUrl,
        profile: "driving",
      }),
      lineOptions: {
        addWaypoints: false,
        extendToWaypoints: true,
        missingRouteTolerance: 20,
        styles: [
          {
            color: "#1A1A1A",
            weight: 10,
            opacity: 0.95,
          },
          {
            color: "#FF6B00",
            weight: 6,
            opacity: 0.96,
          },
        ],
      },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false,
      routeWhileDragging: false,
      show: false,
      showAlternatives: false,
      createMarker: () => null,
    }).addTo(map);

    const controlContainer = routingControl.getContainer();

    if (controlContainer) {
      controlContainer.style.display = "none";
    }

    return () => {
      map.removeControl(routingControl);
    };
  }, [customer, map, restaurant]);

  return null;
}

export default RoutingMachine;
