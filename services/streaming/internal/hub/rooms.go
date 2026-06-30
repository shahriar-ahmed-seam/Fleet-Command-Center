package hub

import "fmt"

// DashboardRoom is the global room every Dispatch_Dashboard joins to receive
const DashboardRoom = "dashboard:global"

func VehicleRoom(id string) string { return fmt.Sprintf("vehicle:%s", id) }

func DeliveryRoom(id string) string { return fmt.Sprintf("delivery:%s", id) }

// RoomFor maps a (kind, id) subscription request to its room key, reporting
// whether the kind is recognized.
func RoomFor(kind SubscriptionKind, id string) (string, bool) {
	switch kind {
	case KindVehicle:
		return VehicleRoom(id), true
	case KindDelivery:
		return DeliveryRoom(id), true
	default:
		return "", false
	}
}
