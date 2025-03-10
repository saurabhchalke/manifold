import { useColor } from 'hooks/use-color'
import { View, type ViewProps } from 'react-native'

export function ThemedView({ style, ...otherProps }: ViewProps) {
  const color = useColor()

  return (
    <View
      style={[{ backgroundColor: color.background }, style]}
      {...otherProps}
    />
  )
}
